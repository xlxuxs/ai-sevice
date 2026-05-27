from transformers import pipeline
from .base import BaseModel

class PipelineSentimentModel(BaseModel):
    def __init__(self, model_name: str, task: str = "sentiment-analysis"):
        self._name = model_name
        self.pipeline = pipeline(task, model=model_name)
    
    def predict(self, text: str, language: str = None) -> tuple[str, float]:
        result = self.pipeline(text)[0]
        label = result['label'].lower()
        # Normalize common variations
        if label in ('pos', 'positive'):
            label = 'positive'
        elif label in ('neg', 'negative'):
            label = 'negative'
        elif label in ('neutral', 'neu'):
            label = 'neutral'
        return label, result['score']
    
    @property
    def name(self) -> str:
        return self._name