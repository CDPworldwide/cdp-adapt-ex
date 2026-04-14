import os

from google.cloud import storage


class GCSStorageClient:
    def __init__(self):
        self.client = storage.Client(
            project=os.getenv("PROJECT_ID"),
        )

    def get_client(self):
        return self.client
