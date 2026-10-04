from django.urls import path
from trips.views import plan_trip, health, index

urlpatterns = [
    path("", index),
    path("api/plan/", plan_trip),
    path("api/health/", health),
]
