from .zero_shot_model import ZeroShotTopicModel

_topic_model = None

def get_topic_model():
    global _topic_model
    if _topic_model is None:
        _topic_model = ZeroShotTopicModel()
    return _topic_model