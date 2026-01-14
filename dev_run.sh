#!/bin/bash

# Start backend server
source .venv/bin/activate
uvicorn app.main:app --reload


### Frontend
cd frontend
# Start development server
npm run dev