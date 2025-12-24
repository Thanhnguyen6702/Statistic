"""
Standardized API response helpers.
"""

from flask import jsonify


def success_response(data=None, message=None):
    """Return a success response."""
    response = {'success': True}

    if data is not None:
        if isinstance(data, dict):
            response.update(data)
        else:
            response['data'] = data

    if message:
        response['message'] = message

    return jsonify(response)


def error_response(message, status_code=400):
    """Return an error response."""
    return jsonify({'error': message}), status_code


def data_response(data):
    """Return a data response (for GET requests)."""
    return jsonify(data)
