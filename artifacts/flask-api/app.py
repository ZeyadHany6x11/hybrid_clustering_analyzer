import os
import json
import uuid
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from preprocessing import load_dataset, preprocess, get_dataset_summary
from clustering import run_kmeans, run_dbscan, run_gmm
from evaluation import evaluate_all, rank_models

app = Flask(__name__)
CORS(app, origins="*")

app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

SESSIONS = {}

ALLOWED_EXTENSIONS = {"csv", "tsv", "json", "txt"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _convert_numpy(obj):
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {k: _convert_numpy(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_numpy(i) for i in obj]
    return obj


@app.route("/api/healthz", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "clustering-analyzer"})


@app.route("/api/upload", methods=["POST"])
def upload():
    try:
        if "file" in request.files:
            f = request.files["file"]
            if f.filename == "":
                return jsonify({"error": "No file selected"}), 400
            if not allowed_file(f.filename):
                return jsonify({"error": "File type not supported. Use CSV, TSV, or JSON."}), 400

            filename = secure_filename(f.filename)
            ext = filename.rsplit(".", 1)[1].lower()
            content = f.read().decode("utf-8")

            df = load_dataset(content, file_type=ext if ext != "txt" else "csv")

        elif request.is_json and request.json.get("use_sample"):
            sample_name = request.json.get("sample_name", "iris")
            content, df = _load_sample_dataset(sample_name)
        else:
            return jsonify({"error": "No file provided. Upload a CSV/TSV/JSON file or use a sample dataset."}), 400

        session_id = str(uuid.uuid4())
        summary = get_dataset_summary(df)

        SESSIONS[session_id] = {
            "df": df,
            "summary": summary,
            "results": None,
            "scaled_data": None,
            "preprocess_info": None,
        }

        return jsonify({
            "session_id": session_id,
            "summary": summary,
            "message": f"Dataset loaded successfully with {summary['n_rows']} rows and {summary['n_cols']} columns.",
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        body = request.get_json()
        if not body:
            return jsonify({"error": "Request body is required"}), 400

        session_id = body.get("session_id")
        if not session_id or session_id not in SESSIONS:
            return jsonify({"error": "Invalid or missing session_id. Upload a dataset first."}), 400

        session = SESSIONS[session_id]
        df = session["df"]

        scaling_method = body.get("scaling_method", "standard")
        handle_missing = body.get("handle_missing", "mean")
        feature_columns = body.get("feature_columns", None)

        X, data_clean, preprocess_info = preprocess(
            df,
            scaling_method=scaling_method,
            handle_missing=handle_missing,
            feature_columns=feature_columns,
        )

        algorithms = body.get("algorithms", ["kmeans", "dbscan", "gmm"])

        kmeans_params = body.get("kmeans_params", {})
        dbscan_params = body.get("dbscan_params", {})
        gmm_params = body.get("gmm_params", {})

        raw_results = {}
        errors = {}

        if "kmeans" in algorithms:
            try:
                raw_results["kmeans"] = run_kmeans(
                    X,
                    n_clusters=kmeans_params.get("n_clusters", None),
                    max_k=kmeans_params.get("max_k", 10),
                    random_state=kmeans_params.get("random_state", 42),
                )
            except Exception as e:
                errors["kmeans"] = str(e)

        if "dbscan" in algorithms:
            try:
                raw_results["dbscan"] = run_dbscan(
                    X,
                    eps=float(dbscan_params.get("eps", 0.5)),
                    min_samples=int(dbscan_params.get("min_samples", 5)),
                )
            except Exception as e:
                errors["dbscan"] = str(e)

        if "gmm" in algorithms:
            try:
                n_comp = gmm_params.get("n_components", None)
                if n_comp is None:
                    if "kmeans" in raw_results:
                        n_comp = raw_results["kmeans"]["optimal_k"]
                    else:
                        n_comp = 3
                raw_results["gmm"] = run_gmm(
                    X,
                    n_components=int(n_comp),
                    covariance_type=gmm_params.get("covariance_type", "full"),
                    random_state=gmm_params.get("random_state", 42),
                )
            except Exception as e:
                errors["gmm"] = str(e)

        evaluation = evaluate_all(X, raw_results)
        ranking = rank_models(evaluation)

        points = []
        for i in range(len(X)):
            point = {
                "idx": i,
                "features": X[i].tolist(),
                "original_features": data_clean.iloc[i].to_dict() if i < len(data_clean) else {},
            }
            for algo, result in raw_results.items():
                point[f"{algo}_label"] = result["labels"][i] if i < len(result["labels"]) else -1
            points.append(point)

        session["scaled_data"] = X
        session["preprocess_info"] = preprocess_info
        session["results"] = {
            "raw_results": raw_results,
            "evaluation": evaluation,
            "ranking": ranking,
            "points": points,
            "errors": errors,
        }

        return jsonify({
            "session_id": session_id,
            "preprocess_info": _convert_numpy(preprocess_info),
            "results": {
                algo: {k: v for k, v in res.items() if k not in ("labels", "probabilities")}
                for algo, res in raw_results.items()
            },
            "evaluation": _convert_numpy(evaluation),
            "ranking": _convert_numpy(ranking),
            "n_points": len(points),
            "errors": errors,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/results", methods=["GET"])
def results():
    try:
        session_id = request.args.get("session_id")
        if not session_id or session_id not in SESSIONS:
            return jsonify({"error": "Invalid or missing session_id"}), 400

        session = SESSIONS[session_id]
        if session["results"] is None:
            return jsonify({"error": "No analysis results yet. Run /api/analyze first."}), 400

        stored = session["results"]
        raw = stored["raw_results"]

        algo_name = request.args.get("algorithm", None)
        include_points = request.args.get("include_points", "true").lower() == "true"

        response = {
            "session_id": session_id,
            "preprocess_info": _convert_numpy(session["preprocess_info"]),
            "evaluation": _convert_numpy(stored["evaluation"]),
            "ranking": _convert_numpy(stored["ranking"]),
            "errors": stored.get("errors", {}),
        }

        if algo_name and algo_name in raw:
            response["algorithm"] = algo_name
            r = raw[algo_name].copy()
            if include_points:
                response["labels"] = r.get("labels", [])
                if "probabilities" in r:
                    response["probabilities"] = r.get("probabilities", [])
            response["metadata"] = {k: v for k, v in r.items() if k not in ("labels", "probabilities")}
        else:
            for algo, r in raw.items():
                algo_data = {k: v for k, v in r.items() if k not in ("probabilities",)}
                if include_points:
                    algo_data["labels"] = r.get("labels", [])
                if algo == "gmm" and include_points:
                    algo_data["probabilities"] = r.get("probabilities", [])
                response[algo] = _convert_numpy(algo_data)

        if include_points:
            response["points"] = _convert_numpy(stored["points"])

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/samples", methods=["GET"])
def list_samples():
    return jsonify({
        "samples": [
            {"name": "iris", "description": "Iris flower dataset — 150 samples, 4 features", "rows": 150, "features": 4},
            {"name": "blobs", "description": "Synthetic Gaussian blobs — 300 samples, 2 features", "rows": 300, "features": 2},
            {"name": "moons", "description": "Synthetic two moons — 200 samples, 2 features", "rows": 200, "features": 2},
            {"name": "circles", "description": "Synthetic concentric circles — 200 samples, 2 features", "rows": 200, "features": 2},
            {"name": "aniso", "description": "Anisotropic blobs — 300 samples, 2 features", "rows": 300, "features": 2},
        ]
    })


def _load_sample_dataset(name: str):
    from sklearn import datasets
    import pandas as pd
    import numpy as np

    if name == "iris":
        data = datasets.load_iris()
        df = pd.DataFrame(data.data, columns=data.feature_names)
        df["species"] = [data.target_names[t] for t in data.target]
    elif name == "blobs":
        X, y = datasets.make_blobs(n_samples=300, centers=4, cluster_std=0.8, random_state=42)
        df = pd.DataFrame(X, columns=["feature_1", "feature_2"])
        df["true_label"] = y
    elif name == "moons":
        X, y = datasets.make_moons(n_samples=200, noise=0.1, random_state=42)
        df = pd.DataFrame(X, columns=["x", "y"])
        df["true_label"] = y
    elif name == "circles":
        X, y = datasets.make_circles(n_samples=200, factor=0.5, noise=0.05, random_state=42)
        df = pd.DataFrame(X, columns=["x", "y"])
        df["true_label"] = y
    elif name == "aniso":
        X, y = datasets.make_blobs(n_samples=300, centers=3, random_state=42)
        transformation = [[0.6, -0.6], [-0.4, 0.8]]
        X = np.dot(X, transformation)
        df = pd.DataFrame(X, columns=["feature_1", "feature_2"])
        df["true_label"] = y
    else:
        raise ValueError(f"Unknown sample dataset: {name}")

    import io
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue(), df


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
