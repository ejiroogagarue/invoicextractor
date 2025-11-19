import { BrowserRouter, Routes, Route } from 'react-router-dom'
import IndexPage from './pages/IndexPage'
import ProcessingPage from './pages/ProcessingPage'
import LoadingPage from './pages/LoadingPage'
import CompletedPage from './pages/CompletedPage'
import DataTablePage from './pages/DataTablePage'
import ReviewPage from './pages/ReviewPage'

function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/processing" element={<ProcessingPage />} />
        <Route path="/loading" element={<LoadingPage />} />
        <Route path="/completed" element={<CompletedPage />} />
        <Route path="/datatable" element={<DataTablePage />} />
        <Route path="/review" element={<ReviewPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter

