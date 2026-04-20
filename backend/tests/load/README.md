# Load Testing with Locust

This directory contains load testing scripts using [Locust](https://locust.io/).

## Prerequisites

Ensure you have the dev dependencies installed:

```bash
cd backend
uv sync
```

## Running the Load Tests

1.  **Start the backend server** (if not already running):
    ```bash
    cd backend
    uv run fastapi dev app/main.py
    ```

2.  **Run Locust**:
    ```bash
    cd backend
    uv run locust -f tests/load/locustfile.py
    ```

3.  **Open the Web Interface**:
    Locust will start a web server at `http://localhost:8089`. Open this in your browser to configure the number of users and spawn rate, and to start the test.

## Running Headless

To run a test without the web interface:

```bash
uv run locust -f tests/load/locustfile.py --headless -u 10 -r 1 --run-time 1m --host http://localhost:8000
```
