#!/bin/bash

echo "🏥 Health Risk Analyzer - Startup Script"
echo "========================================="

# Start Flask backend
echo ""
echo "▶ Starting Flask backend on port 5000..."
cd backend
pip install -r requirements.txt -q
python app.py &
BACKEND_PID=$!
echo "  ✅ Backend running (PID: $BACKEND_PID)"

# Start React frontend
echo ""
echo "▶ Starting React frontend on port 3000..."
cd ../frontend
npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "  ✅ Frontend running (PID: $FRONTEND_PID)"

echo ""
echo "========================================="
echo "🚀 App is running!"
echo "   Frontend → http://localhost:3000"
echo "   Backend  → http://localhost:5000"
echo ""
echo "📁 Sample files in: sample-data/"
echo "   • patients.csv  (8 patients)"
echo "   • patients.json (4 patients)"  
echo "   • report.txt    (free-text)"
echo ""
echo "Press Ctrl+C to stop both servers."
echo "========================================="

# Wait
wait $BACKEND_PID $FRONTEND_PID
