from typing import Protocol


class StorageClient(Protocol):
    def get_client(self): ...
