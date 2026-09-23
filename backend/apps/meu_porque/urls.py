from rest_framework.routers import DefaultRouter

from .views import MeuPorqueRespostaViewSet

router = DefaultRouter()
router.register('respostas', MeuPorqueRespostaViewSet, basename='meu-porque-resposta')

urlpatterns = router.urls
