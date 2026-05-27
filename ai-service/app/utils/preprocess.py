import re

def normalize_text(text: str) -> str:
    """
    Basic normalization for Ethiopian languages.
    - Lowercase
    - Remove extra spaces
    - Optionally handle common romanization variations
    """
    text = text.lower()
    # Remove URLs
    text = re.sub(r'http\S+', '', text)
    # Remove extra spaces
    text = ' '.join(text.split())
    return text