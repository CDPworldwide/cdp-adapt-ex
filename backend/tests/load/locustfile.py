from locust import HttpUser, between, task


class PACUser(HttpUser):
    wait_time = between(1, 5)

    @task(4)
    def get_location_names(self):
        """Task to hit the location names endpoint."""
        self.client.get("/api/v1/location/names")

    @task(4)
    def get_location_pins(self):
        """Task to hit the location pins endpoint."""
        self.client.get("/api/v1/location/pins")

    @task(1)
    def chat_completion(self):
        """Task to hit the chat completions endpoint."""
        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": "Tell me about climate hazards in Bogor City Government",
                }
            ],
            "location_data": {
                "organization_id": 101,
                "name": "Bogor City Government",
                "country_name": "Indonesia",
                "lat": -6.5971,
                "lng": 106.8060,
                "geometry": {"type": "Point", "coordinates": [106.8060, -6.5971]},
                "hazards": {"statistics": {}},
                "government_actions": {},
                "solutions": {},
            },
        }
        self.client.post("/api/v1/chat/completions", json=payload)

    @task(1)
    def get_location_details_by_id(self):
        """Task to hit the location details endpoint by ID."""
        self.client.get("/api/v1/location/id/46473")

    def on_start(self):
        """Executed when a simulated user starts."""
        # Add any setup logic here (e.g., logging in if needed)
        pass
