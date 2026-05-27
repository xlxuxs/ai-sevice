# ai-service/app/models/sentiment/registry.py

MODEL_REGISTRY = {
    "am": [
        {
            "name": "cardiffnlp/twitter-xlm-roberta-base-sentiment",
            "type": "pipeline",
            "task": "sentiment-analysis",
            "languages": ["am", "en"]
        }
    ],
    "en": [
        {
            "name": "cardiffnlp/twitter-xlm-roberta-base-sentiment",
            "type": "pipeline",
            "task": "sentiment-analysis",
            "languages": ["en"]
        }
    ],
    "ti": [
        {
            "name": "fgaim/tiroberta-sentiment",
            "type": "pipeline",
            "task": "sentiment-analysis",
            "languages": ["ti"]
        },
        {
            "name": "cardiffnlp/twitter-xlm-roberta-base-sentiment",
            "type": "pipeline",
            "task": "sentiment-analysis",
            "languages": ["ti"]
        }
    ]
    # Oromo intentionally absent → will fall back to dummy
}

ALL_MODELS = [
    {
        "name": "cardiffnlp/twitter-xlm-roberta-base-sentiment",
        "type": "pipeline",
        "task": "sentiment-analysis",
        "languages": ["am", "en", "ti"]
    },
    {
        "name": "fgaim/tiroberta-sentiment",
        "type": "pipeline",
        "task": "sentiment-analysis",
        "languages": ["ti"]
    }
]