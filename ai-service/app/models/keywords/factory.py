from typing import Dict, Any
from .base import BaseKeywordModel
from .keybert_model import KeyBERTKeywordModel
from .registry import get_keyword_model_config

class KeywordModelFactory:
    _instances = {}  # Cache loaded models by model_id

    @classmethod
    def get_model(cls, model_id: str = "default") -> BaseKeywordModel:
        """Get or create a keyword model instance (lazy loading)."""
        if model_id in cls._instances:
            return cls._instances[model_id]

        config = get_keyword_model_config(model_id)
        model_type = config["type"]

        if model_type == "keybert":
            model = KeyBERTKeywordModel(model_name=config["model_name"])
        else:
            raise ValueError(f"Unknown keyword model type: {model_type}")

        cls._instances[model_id] = model
        return model