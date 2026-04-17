import React, { useEffect } from "react";

function App() {
  useEffect(() => {
    fetch("http://localhost:8080")
      .then(res => res.text())
      .then(data => console.log(data));
  }, []);

  return <div className="App">Hello World</div>;
}

export default App;
