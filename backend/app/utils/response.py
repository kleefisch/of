from flask import jsonify
from typing import Any


def success_response(data: Any, message: str = "Success", status_code: int = 200):
    return jsonify({"data": data, "message": message}), status_code


def error_response(error: str, code: str, status_code: int):
    return jsonify({"error": error, "code": code}), status_code
