from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allows access only to users with role == 'admin' (or superuser)."""

    message = "You must be an admin to perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin)
