import React from "react";
import { HashRouter, Route, Switch } from "react-router-dom";

import Auth from "./views/Auth";
import About from "./views/About";

import "./css/reset.css";
import "./css/App.css";

const App = () => {
  return (
    <HashRouter>
      <Switch>
        <Route exact path="/auth" component={Auth} />
        <Route exact path="/about" component={About} />
      </Switch>
    </HashRouter>
  );
};

export default App;
