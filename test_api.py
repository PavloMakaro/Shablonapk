import requests

url = "http://c11.play2go.cloud:20067"

def check(method, path, **kwargs):
    try:
        req = requests.request(method, url + path, **kwargs)
        print(f"{method} {path} -> {req.status_code} {req.text[:200]}")
    except Exception as e:
        print(f"Error {path}: {e}")

check("POST", "/auth/register", json={"username":"test", "password":"123"})
check("POST", "/api/register", json={"username":"test", "password":"123"})
check("POST", "/register", json={"username":"test", "password":"123"})
check("POST", "/auth/login", json={"username":"test", "password":"123"})
check("POST", "/login", json={"username":"test", "password":"123"})
check("GET", "/auth/link_code")
check("POST", "/auth/link_code", json={"code":"123"})
