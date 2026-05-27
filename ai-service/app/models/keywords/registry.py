from typing import Dict, Any

KEYWORD_MODELS = {
    "default": {
        "type": "keybert",
        "model_name": "paraphrase-multilingual-MiniLM-L12-v2",
        "description": "KeyBERT with multilingual sentence transformer"
    }
    # You can add more variants later, e.g., "keybert-small", "custom", etc.
}

def get_keyword_model_config(model_id: str = "default") -> Dict[str, Any]:
    """Return configuration for the given keyword model ID."""
    return KEYWORD_MODELS.get(model_id, KEYWORD_MODELS["default"])