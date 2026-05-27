# ai-service/app/models/sentiment/manager.py
from .registry import MODEL_REGISTRY, ALL_MODELS
from .factory import create_model
from .base import BaseModel

class DummySentimentModel(BaseModel):
    """Fallback model for languages without real sentiment support (e.g., Oromo)."""
    @property
    def name(self):
        return "dummy_fallback"
    
    def predict(self, text, language):
        # Return neutral with low confidence, so comments go to needs_review
        return "neutral", 0.3

class ModelManager:
    """Facade for accessing models."""
    
    @staticmethod
    def get_model_for_language(language: str, preferred_model: str = None):
        """Get the default model for a language, or a specific one."""
        if language not in MODEL_REGISTRY or not MODEL_REGISTRY[language]:
            # No model registered → return dummy
            return DummySentimentModel()
        
        models_config = MODEL_REGISTRY[language]
        if preferred_model:
            for cfg in models_config:
                if cfg["name"] == preferred_model:
                    return create_model(cfg)
            # fallback to first
            return create_model(models_config[0])
        else:
            # Return the first model as default
            return create_model(models_config[0])
    
    @staticmethod
    def get_all_models_for_language(language: str):
        """Get all models that support this language."""
        if language not in MODEL_REGISTRY or not MODEL_REGISTRY[language]:
            return [DummySentimentModel()]
        return [create_model(cfg) for cfg in MODEL_REGISTRY[language]]
    
    @staticmethod
    def get_all_models():
        """Get all models (for benchmarking)."""
        return [create_model(cfg) for cfg in ALL_MODELS]