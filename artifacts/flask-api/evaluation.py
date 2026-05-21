import numpy as np
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score


def compute_silhouette(X: np.ndarray, labels: list) -> float:
    labels_arr = np.array(labels)
    unique_labels = set(labels_arr[labels_arr != -1])

    if len(unique_labels) < 2:
        return None

    valid_mask = labels_arr != -1
    if valid_mask.sum() < 2:
        return None

    X_valid = X[valid_mask]
    labels_valid = labels_arr[valid_mask]

    unique_valid = np.unique(labels_valid)
    if len(unique_valid) < 2:
        return None

    try:
        score = silhouette_score(X_valid, labels_valid)
        return float(score)
    except Exception:
        return None


def compute_davies_bouldin(X: np.ndarray, labels: list) -> float:
    labels_arr = np.array(labels)
    unique_labels = set(labels_arr[labels_arr != -1])

    if len(unique_labels) < 2:
        return None

    valid_mask = labels_arr != -1
    X_valid = X[valid_mask]
    labels_valid = labels_arr[valid_mask]

    try:
        score = davies_bouldin_score(X_valid, labels_valid)
        return float(score)
    except Exception:
        return None


def compute_calinski_harabasz(X: np.ndarray, labels: list) -> float:
    labels_arr = np.array(labels)
    unique_labels = set(labels_arr[labels_arr != -1])

    if len(unique_labels) < 2:
        return None

    valid_mask = labels_arr != -1
    X_valid = X[valid_mask]
    labels_valid = labels_arr[valid_mask]

    try:
        score = calinski_harabasz_score(X_valid, labels_valid)
        return float(score)
    except Exception:
        return None


def evaluate_all(X: np.ndarray, results: dict) -> dict:
    evaluation = {}

    for model_name, model_result in results.items():
        labels = model_result.get("labels", [])
        if not labels:
            continue

        sil = compute_silhouette(X, labels)
        db = compute_davies_bouldin(X, labels)
        ch = compute_calinski_harabasz(X, labels)

        evaluation[model_name] = {
            "silhouette_score": sil,
            "davies_bouldin_score": db,
            "calinski_harabasz_score": ch,
            "n_clusters": model_result.get("n_clusters", 0),
        }

    return evaluation


def rank_models(evaluation: dict) -> list:
    ranked = []
    for model_name, metrics in evaluation.items():
        sil = metrics.get("silhouette_score")
        db = metrics.get("davies_bouldin_score")

        score_components = []
        if sil is not None:
            score_components.append(sil)
        if db is not None:
            score_components.append(-db / 10.0)

        composite = float(np.mean(score_components)) if score_components else None

        ranked.append({
            "model": model_name,
            "composite_score": composite,
            **metrics,
        })

    ranked.sort(key=lambda x: x["composite_score"] if x["composite_score"] is not None else float("-inf"), reverse=True)
    return ranked
