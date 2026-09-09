import asyncio
import httpx
import json

CLIENT_ID = "32555940559.apps.googleusercontent.com"
CLIENT_SECRET = "<REDACTED_CLIENT_SECRET>"

async def test_device_flow():
    print("Requesting device code...")
    async with httpx.AsyncClient() as client:
        # Request device code
        resp = await client.post("https://oauth2.googleapis.com/device/code", data={
            "client_id": CLIENT_ID,
            "scope": "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/generative-language.retriever"
        })
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
        
if __name__ == "__main__":
    asyncio.run(test_device_flow())
