from rest_framework.routers import DefaultRouter

from .views import DiscRespostaViewSet

router = DefaultRouter()
router.register('respostas', DiscRespostaViewSet, basename='disc-resposta')

urlpatterns = router.urls
