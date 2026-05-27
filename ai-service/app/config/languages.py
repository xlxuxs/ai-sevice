# ai-service/app/config/languages.py

# Only the models we actually load. Oromo omitted (will use dummy).
SENTIMENT_MODELS = {
    "am": {
        "model": "cardiffnlp/twitter-xlm-roberta-base-sentiment",
        "labels": {0: "negative", 1: "neutral", 2: "positive"},
        "description": "XLM-R Twitter sentiment (Amharic & English)"
    },
    "ti": {
        "model": "ensemble",  # special marker; we'll handle in code
        "models": [
            {"name": "fgaim/tiroberta-sentiment", "type": "pipeline", "task": "sentiment-analysis"},
            {"name": "cardiffnlp/twitter-xlm-roberta-base-sentiment", "type": "pipeline", "task": "sentiment-analysis"}
        ],
        "description": "Ensemble of binary Tigrinya model + Twitter model"
    },
    "en": {
        "model": "cardiffnlp/twitter-xlm-roberta-base-sentiment",
        "labels": {0: "negative", 1: "neutral", 2: "positive"},
        "description": "XLM-R Twitter sentiment (English)"
    }
}