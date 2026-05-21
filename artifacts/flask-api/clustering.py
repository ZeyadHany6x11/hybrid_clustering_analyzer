import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.mixture import GaussianMixture


def run_kmeans(X: np.ndarray, n_clusters: int = None, max_k: int = 10, random_state: int = 42) -> dict:
    wcss = []
    k_range = range(1, min(max_k + 1, X.shape[0]))

    for k in k_range:
        km = KMeans(n_clusters=k, init="k-means++", n_init=10, random_state=random_state)
        km.fit(X)
        wcss.append(float(km.inertia_))

    optimal_k = _detect_elbow(list(k_range), wcss)

    if n_clusters is None:
        n_clusters = optimal_k

    final_km = KMeans(n_clusters=n_clusters, init="k-means++", n_init=10, random_state=random_state)
    labels = final_km.fit_predict(X)
    centers = final_km.cluster_centers_

    cluster_sizes = {}
    for label in np.unique(labels):
        cluster_sizes[int(label)] = int(np.sum(labels == label))

    return {
        "labels": labels.tolist(),
        "centers": centers.tolist(),
        "n_clusters": int(n_clusters),
        "optimal_k": int(optimal_k),
        "wcss": wcss,
        "k_values": list(k_range),
        "inertia": float(final_km.inertia_),
        "cluster_sizes": cluster_sizes,
        "n_iter": int(final_km.n_iter_),
    }


def _detect_elbow(k_values: list, wcss: list) -> int:
    if len(wcss) < 3:
        return k_values[0]

    wcss_arr = np.array(wcss)
    n = len(wcss_arr)
    coords = np.column_stack([np.array(k_values), wcss_arr])

    p1 = coords[0]
    p2 = coords[-1]
    line_vec = p2 - p1
    line_vec_norm = line_vec / np.linalg.norm(line_vec)

    vec_from_first = coords - p1
    scalar_proj = np.dot(vec_from_first, line_vec_norm)
    proj_on_line = np.outer(scalar_proj, line_vec_norm)
    rejection = vec_from_first - proj_on_line
    distances = np.linalg.norm(rejection, axis=1)

    elbow_idx = int(np.argmax(distances))
    return k_values[elbow_idx]


def run_dbscan(X: np.ndarray, eps: float = 0.5, min_samples: int = 5) -> dict:
    db = DBSCAN(eps=eps, min_samples=min_samples)
    labels = db.fit_predict(X)

    unique_labels = set(labels)
    n_clusters = len(unique_labels - {-1})
    n_noise = int(np.sum(labels == -1))

    cluster_sizes = {}
    for label in np.unique(labels):
        cluster_sizes[int(label)] = int(np.sum(labels == label))

    core_samples_mask = np.zeros_like(labels, dtype=bool)
    core_samples_mask[db.core_sample_indices_] = True

    return {
        "labels": labels.tolist(),
        "n_clusters": int(n_clusters),
        "n_noise": int(n_noise),
        "eps": float(eps),
        "min_samples": int(min_samples),
        "cluster_sizes": cluster_sizes,
        "core_sample_count": int(len(db.core_sample_indices_)),
    }


def run_gmm(X: np.ndarray, n_components: int = 3, covariance_type: str = "full", random_state: int = 42) -> dict:
    gmm = GaussianMixture(
        n_components=n_components,
        covariance_type=covariance_type,
        random_state=random_state,
        max_iter=200,
        n_init=5,
    )
    gmm.fit(X)

    labels = gmm.predict(X)
    probabilities = gmm.predict_proba(X)

    cluster_sizes = {}
    for label in np.unique(labels):
        cluster_sizes[int(label)] = int(np.sum(labels == label))

    means = gmm.means_.tolist()

    top_probs = []
    for i, row in enumerate(probabilities):
        assigned = int(labels[i])
        top_probs.append({
            "sample_idx": i,
            "assigned_cluster": assigned,
            "probabilities": {str(j): float(p) for j, p in enumerate(row)},
            "confidence": float(row[assigned]),
        })

    avg_confidence = float(np.mean([p["confidence"] for p in top_probs]))

    return {
        "labels": labels.tolist(),
        "probabilities": probabilities.tolist(),
        "sample_probs": top_probs[:100],
        "means": means,
        "n_components": int(n_components),
        "covariance_type": covariance_type,
        "log_likelihood": float(gmm.lower_bound_),
        "converged": bool(gmm.converged_),
        "n_iter": int(gmm.n_iter_),
        "cluster_sizes": cluster_sizes,
        "avg_confidence": avg_confidence,
        "bic": float(gmm.bic(X)),
        "aic": float(gmm.aic(X)),
    }
