# ai-service/app/models/keywords/manager.py
from .factory import KeywordModelFactory

class KeywordManager:
    @staticmethod
    def extract(text: str, language: str = 'en', top_n: int = 5) -> list:
        """Extract keywords using the default model."""
        model = KeywordModelFactory.get_model("default")
        return model.extract(text, language, top_n)
    
    @staticmethod
    def extract_with_model(text: str, model_id: str, language: str = 'en', top_n: int = 5) -> list:
        """Extract keywords using a specific model (for benchmarking)."""
        model = KeywordModelFactory.get_model(model_id)
        return model.extract(text, language, top_n)
    
    @staticmethod
    def get_available_models() -> list:
        """Return list of available keyword model IDs."""
        from .registry import KEYWORD_MODELS
        return list(KEYWORD_MODELS.keys())
    
    @staticmethod
    def get_default_model_name() -> str:
        """Return the name of the default keyword extraction model."""
        model = KeywordModelFactory.get_model("default")
        return model.name