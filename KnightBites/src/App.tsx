import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import CardPage from './pages/CardPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Route for LoginPage */}
        <Route path="/" element={<LoginPage />} />
        
        {/* Route for CardPage */}
        <Route path="/cards" element={<CardPage />} />
        
        {/* Fallback route to redirect to home if no route matches */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;


/*import React from 'react';
import { BrowserRouter as Router, Route, Redirect, Switch } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import CardPage from './pages/CardPage';
function App() {
return (
<Router >
<Switch>
<Route path="/" exact>
<LoginPage />
</Route>
<Route path="/cards" exact>
<CardPage />
</Route>
<Redirect to="/" />
</Switch>
</Router>
);
}
export default App;
*/