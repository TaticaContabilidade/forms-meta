from rest_framework.routers import DefaultRouter

from .views import MetaComercialViewSet

router = DefaultRouter()
router.register('respostas', MetaComercialViewSet, basename='metas-resposta')

urlpatterns = router.urls
