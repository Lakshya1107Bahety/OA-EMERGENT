import os
import json
import re
import copy
import logging
from pathlib import Path
from datetime import datetime, timezone
from bson import ObjectId

logger = logging.getLogger("jointcare.db")

DATA_DIR = Path(__file__).parent / "data"
DATA_FILE = DATA_DIR / "local_db.json"


def _matches_filter(doc: dict, filt: dict) -> bool:
    if not filt:
        return True

    for k, v in filt.items():
        if k == "$or":
            if not any(_matches_filter(doc, sub_filt) for sub_filt in v):
                return False
            continue

        # Handle nested keys like "result.risk_level"
        doc_val = doc
        parts = k.split(".")
        for part in parts:
            if isinstance(doc_val, dict) and part in doc_val:
                doc_val = doc_val[part]
            else:
                doc_val = None
                break

        if isinstance(v, dict):
            if "$in" in v:
                if doc_val not in v["$in"]:
                    return False
            elif "$regex" in v:
                pattern = v["$regex"]
                flags = re.IGNORECASE if v.get("$options") == "i" else 0
                if not doc_val or not re.search(pattern, str(doc_val), flags):
                    return False
            elif "$eq" in v:
                if doc_val != v["$eq"]:
                    return False
        else:
            # Direct value or ObjectId comparison
            if k == "_id":
                if str(doc.get("_id")) != str(v):
                    return False
            elif str(doc_val) != str(v) and doc_val != v:
                return False

    return True


class InMemoryCursor:
    def __init__(self, docs: list):
        self._docs = docs

    def sort(self, key_or_list, direction=1):
        if isinstance(key_or_list, list):
            for k, d in reversed(key_or_list):
                self._docs.sort(key=lambda x: x.get(k) or "", reverse=(d < 0))
        elif isinstance(key_or_list, str):
            self._docs.sort(key=lambda x: x.get(key_or_list) or "", reverse=(direction < 0))
        return self

    async def to_list(self, length: int = 1000):
        return [copy.deepcopy(d) for d in self._docs[:length]]


class InMemoryInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class InMemoryCollection:
    def __init__(self, name: str, parent_db):
        self.name = name
        self.parent_db = parent_db

    @property
    def docs(self):
        return self.parent_db._store.setdefault(self.name, [])

    async def create_index(self, *args, **kwargs):
        return True

    async def insert_one(self, doc: dict):
        new_doc = copy.deepcopy(doc)
        if "_id" not in new_doc:
            new_doc["_id"] = ObjectId()
        elif isinstance(new_doc["_id"], str):
            try:
                new_doc["_id"] = ObjectId(new_doc["_id"])
            except Exception:
                pass
        self.docs.append(new_doc)
        self.parent_db._save_to_disk()
        return InMemoryInsertResult(new_doc["_id"])

    async def find_one(self, filt: dict = None, sort=None):
        filt = filt or {}
        matches = [d for d in self.docs if _matches_filter(d, filt)]
        if not matches:
            return None

        if sort:
            cursor = InMemoryCursor(matches)
            cursor.sort(sort if not isinstance(sort, list) else sort)
            return copy.deepcopy(cursor._docs[0])
        return copy.deepcopy(matches[0])

    def find(self, filt: dict = None):
        filt = filt or {}
        matches = [d for d in self.docs if _matches_filter(d, filt)]
        return InMemoryCursor(matches)

    async def update_one(self, filt: dict, update: dict):
        for doc in self.docs:
            if _matches_filter(doc, filt):
                if "$set" in update:
                    for k, v in update["$set"].items():
                        parts = k.split(".")
                        curr = doc
                        for p in parts[:-1]:
                            curr = curr.setdefault(p, {})
                        curr[parts[-1]] = copy.deepcopy(v)
                self.parent_db._save_to_disk()
                return True
        return False

    async def delete_many(self, filt: dict):
        filt = filt or {}
        before = len(self.docs)
        self.parent_db._store[self.name] = [d for d in self.docs if not _matches_filter(d, filt)]
        if len(self.parent_db._store[self.name]) != before:
            self.parent_db._save_to_disk()
        return True

    async def count_documents(self, filt: dict = None):
        filt = filt or {}
        return sum(1 for d in self.docs if _matches_filter(d, filt))


class ResilientDatabase:
    def __init__(self):
        self._store = {}
        self._load_from_disk()

    def __getitem__(self, name: str):
        return getattr(self, name)

    def __getattr__(self, name: str):
        col = InMemoryCollection(name, self)
        setattr(self, name, col)
        return col

    def _load_from_disk(self):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if DATA_FILE.exists():
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                    for col_name, items in raw.items():
                        for item in items:
                            if "_id" in item and isinstance(item["_id"], str):
                                try:
                                    item["_id"] = ObjectId(item["_id"])
                                except Exception:
                                    pass
                        self._store[col_name] = items
                logger.info(f"Loaded existing local DB state from {DATA_FILE}")
            except Exception as e:
                logger.warning(f"Could not load local DB state: {e}")

    def _save_to_disk(self):
        try:
            serializable = {}
            for col_name, items in self._store.items():
                col_list = []
                for item in items:
                    c = copy.deepcopy(item)
                    if "_id" in c:
                        c["_id"] = str(c["_id"])
                    col_list.append(c)
                serializable[col_name] = col_list
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(serializable, f, indent=2, default=str)
        except Exception as e:
            logger.warning(f"Could not save local DB state to disk: {e}")


class DummyClient:
    def __init__(self, db_instance):
        self._db = db_instance

    def __getitem__(self, name: str):
        return self._db

    def close(self):
        pass


def init_database(mongo_url: str = None, db_name: str = "jointcare_ai"):
    """
    Attempts to connect to MongoDB with a short timeout.
    If unavailable, gracefully falls back to ResilientDatabase (in-memory + local JSON file).
    """
    mongo_url = mongo_url or os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    try:
        from pymongo import MongoClient
        import certifi
        import re

        # Mask password in log output
        safe_url = re.sub(r":([^:@]+)@", ":****@", mongo_url)
        logger.info(f"Testing MongoDB connection at {safe_url}...")

        # Use 5000ms timeout for Atlas / cloud connections and certifi for Windows SSL support
        client_kwargs = {
            "serverSelectionTimeoutMS": 5000,
            "tlsCAFile": certifi.where() if "mongodb+srv://" in mongo_url or "ssl=true" in mongo_url.lower() else None
        }
        client_kwargs = {k: v for k, v in client_kwargs.items() if v is not None}

        sync_client = MongoClient(mongo_url, **client_kwargs)
        sync_client.admin.command('ping')
        sync_client.close()

        # Connect with Motor
        from motor.motor_asyncio import AsyncIOMotorClient
        motor_client = AsyncIOMotorClient(mongo_url, **client_kwargs)
        real_db = motor_client[db_name]
        logger.info(f"Successfully connected to live MongoDB: {db_name}")
        return motor_client, real_db, False
    except Exception as e:
        logger.warning(f"MongoDB connection failed ({e}). Activating resilient In-Memory/Local JSON DB fallback.")
        fallback_db = ResilientDatabase()
        fallback_client = DummyClient(fallback_db)
        return fallback_client, fallback_db, True
