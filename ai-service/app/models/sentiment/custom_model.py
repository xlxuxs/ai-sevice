from .base import BaseModel
from .sentiment import SentimentModel as LegacySentimentModel
from app.config.languages import SENTIMENT_MODELS

class CustomSentimentModel(BaseModel):
    def __init__(self, model_name: str):
        self._name = model_name
        # Legacy model loads all languages internally
        self.model = LegacySentimentModel()
    
    def predict(self, text: str, language: str = None) -> tuple[str, float]:
        if language is None:
            raise ValueError("Language must be provided for custom model")
        return self.model.analyze(text, language)
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def languages(self) -> list[str]:
        # Return languages this model supports (from your config)
        return list(SENTIMENT_MODELS.keys())