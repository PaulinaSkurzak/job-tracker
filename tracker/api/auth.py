"""Session login for the frontend.

Flow: the frontend calls GET /api/auth/csrf/ once to get a CSRF cookie, then POSTs credentials to
/api/auth/login/ with that token in the X-CSRFToken header. Django sets its normal session cookie,
and every later API call is authenticated by it.
"""

from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.views import APIView


class UserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(style={"input_type": "password"}, trim_whitespace=False)


class DetailSerializer(serializers.Serializer):
    detail = serializers.CharField()


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfView(APIView):
    """Sets the csrftoken cookie. Safe to call when logged out."""

    permission_classes = [AllowAny]

    @extend_schema(responses=DetailSerializer)
    def get(self, request):
        return Response({"detail": "CSRF cookie set"})


class LoginRateThrottle(SimpleRateThrottle):
    """Caps login attempts across everyone, not per IP address.

    This is a single-user app, so a shared cap is the strongest guard against password guessing: an
    attacker cannot get around it by switching IP addresses. The cost is that a flood of bad attempts also
    blocks the owner until the hour is up. The count lives in Django's cache (in memory, per process).
    """

    scope = "login"

    def get_cache_key(self, request, view):
        return "throttle_login"


# DRF only enforces CSRF for users who are already logged in. Login itself is a request from a
# logged-out user, so it needs csrf_protect explicitly; otherwise another site could log the
# browser into an account of the attacker's choosing ("login CSRF").
@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    @extend_schema(request=LoginSerializer, responses={200: UserSerializer, 400: DetailSerializer})
    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = authenticate(request, **data.validated_data)
        if user is None:
            # Same message whether the username or the password was wrong, so it does not reveal which
            # usernames exist.
            return Response({"detail": "Invalid username or password."}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)  # also rotates the session key and the CSRF token
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """Lets the frontend ask "am I logged in, and as whom?" on page load."""

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)
