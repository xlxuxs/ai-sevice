from transformers import pipeline
from .base import BaseModel
from .pipeline_model import PipelineSentimentModel
from .custom_model import CustomSentimentModel

_model_cache = {}

def create_model(config: dict) -> BaseModel:
    """Create or retrieve a cached model instance from config."""
    model_name = config["name"]
    if model_name in _model_cache:
        return _model_cache[model_name]
    
    if config["type"] == "pipeline":
        model = PipelineSentimentModel(
            model_name=config["name"],
            task=config.get("task", "sentiment-analysis")
        )
    elif config["type"] == "custom":
        model = CustomSentimentModel(model_name=config["name"])
    else:
        raise ValueError(f"Unknown model type: {config['type']}")
    
    _model_cache[model_name] = model
    return model