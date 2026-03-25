// Bootstrap starts the application once all classic scripts have populated the
// expected globals. Keeping startup tiny makes load-order issues easier to spot.
(function bootstrapMazeApp() {
    const AppController = window.MazeAppController;
    const app = new AppController();
    app.init();
})();