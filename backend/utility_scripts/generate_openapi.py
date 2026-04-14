import json

from app.main import app


def generate_openapi_spec():
    """Generates the OpenAPI spec and saves it to the client directory."""
    output_path = "../client/openapi.json"
    with open(output_path, "w") as f:
        json.dump(app.openapi(), f, indent=2)
    print(f"✅ OpenAPI spec generated at {output_path}")


if __name__ == "__main__":
    generate_openapi_spec()
