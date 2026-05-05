from locust import HttpUser, between, task


class PACUser(HttpUser):
    wait_time = between(1, 5)

    @task(4)
    def get_location_names(self):
        """Task to hit the location names endpoint."""
        self.client.get("/api/v1/locations/names")

    @task(4)
    def get_location_pins(self):
        """Task to hit the location pins endpoint."""
        self.client.get("/api/v1/locations/pins")

    @task(1)
    def get_location_details_by_id(self):
        """Task to hit the location details endpoint by ID."""
        self.client.get("/api/v1/locations/id/46473")

    def on_start(self):
        """Executed when a simulated user starts."""
        # Add any setup logic here (e.g., logging in if needed)
        pass
