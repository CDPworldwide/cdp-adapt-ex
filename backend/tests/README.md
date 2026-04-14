# Backend Testing

This folder contains the backend tests for the CDP Webapp.

## Running Tests

To run the backend tests, navigate to the `backend` directory and use `pytest`:

```bash
cd backend
pytest
```

For more detailed output:

```bash
pytest -v
```

## Structure

- `api/`: Integration tests for API endpoints.
- `unit/`: Unit tests for services and utilities.
- `conftest.py`: Shared fixtures for the testing suite.
