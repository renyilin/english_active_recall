from fastapi import APIRouter

from app.api.v1 import auth, cards, generate, health, tags, users

api_router = APIRouter()

# Include all v1 routers
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(cards.router)
api_router.include_router(tags.router)
api_router.include_router(generate.router)

