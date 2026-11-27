from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .api import urls as api_urls

PASSWORD = "a-strong-test-password"


def csrf_client():
    """A client that enforces CSRF like a real browser session (DRF's test client skips it by default)."""
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api_csrf"))
    return client, client.cookies["csrftoken"].value


class AuthFlowTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user("paulina", password=PASSWORD)

    def test_csrf_endpoint_sets_cookie_when_logged_out(self):
        response = APIClient().get(reverse("api_csrf"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("csrftoken", response.cookies)

    def test_login_then_me_returns_the_user(self):
        client, token = csrf_client()
        response = client.post(
            reverse("api_login"), {"username": "paulina", "password": PASSWORD}, format="json", HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"id": self.user.id, "username": "paulina"})

        me = client.get(reverse("api_me"))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["username"], "paulina")

    def test_wrong_password_gives_a_generic_error(self):
        client, token = csrf_client()
        response = client.post(
            reverse("api_login"), {"username": "paulina", "password": "wrong"}, format="json", HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": "Invalid username or password."})

    def test_unknown_user_gets_the_same_error_as_wrong_password(self):
        client, token = csrf_client()
        response = client.post(
            reverse("api_login"), {"username": "nobody", "password": "x"}, format="json", HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(response.json(), {"detail": "Invalid username or password."})

    def test_login_without_csrf_token_is_rejected(self):
        client, _ = csrf_client()
        response = client.post(reverse("api_login"), {"username": "paulina", "password": PASSWORD}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(client.get(reverse("api_me")).status_code, 403)  # and no session was created

    def test_logout_ends_the_session(self):
        client, token = csrf_client()
        client.post(
            reverse("api_login"), {"username": "paulina", "password": PASSWORD}, format="json", HTTP_X_CSRFTOKEN=token
        )
        token = client.cookies["csrftoken"].value  # login rotates the token
        self.assertEqual(client.post(reverse("api_logout"), HTTP_X_CSRFTOKEN=token).status_code, 204)
        self.assertEqual(client.get(reverse("api_me")).status_code, 403)

    def test_logged_in_write_without_csrf_token_is_rejected(self):
        client, token = csrf_client()
        client.post(
            reverse("api_login"), {"username": "paulina", "password": PASSWORD}, format="json", HTTP_X_CSRFTOKEN=token
        )
        self.assertEqual(client.post(reverse("api_logout")).status_code, 403)
        self.assertEqual(client.get(reverse("api_me")).status_code, 200)  # still logged in


class LoginRequiredTests(TestCase):
    # Endpoints a logged-out visitor is allowed to reach. Anything not listed must require login.
    PUBLIC = {"api_csrf", "api_login"}

    def test_every_other_api_endpoint_requires_login(self):
        client = APIClient()
        patterns = [p for p in api_urls.urlpatterns if p.name and p.name not in self.PUBLIC]
        self.assertGreater(len(patterns), 10)
        for pattern in patterns:
            # Fill any URL parameters (like {pk}) with a dummy id; the login check runs before the lookup.
            kwargs = {key: 1 for key in pattern.pattern.regex.groupindex}
            with self.subTest(endpoint=pattern.name):
                self.assertEqual(client.get(reverse(pattern.name, kwargs=kwargs)).status_code, 403)

    def test_schema_is_served_to_a_logged_in_user(self):
        user = get_user_model().objects.create_user("paulina", password=PASSWORD)
        client = APIClient()
        client.force_authenticate(user)
        response = client.get(reverse("api_schema"), {"format": "json"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("/api/auth/me/", response.json()["paths"])
