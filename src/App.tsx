
import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import EcommercePage from './pages/EcommercePage'
import ConsultantPage from './pages/ConsultantPage'
import GigSharePage from './pages/GigSharePage'


export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/ecommerce" element={<EcommercePage />} />
        <Route path="/consultant" element={<ConsultantPage />} />
        <Route path="/gig-worker" element={<GigSharePage />} />
      </Routes>
    </Router>
  )
}
