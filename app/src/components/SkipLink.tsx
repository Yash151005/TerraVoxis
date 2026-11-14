export function SkipLink() {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(e) => {
        // Hash routing owns the URL fragment, so move focus by hand.
        e.preventDefault();
        const main = document.getElementById('main');
        if (main) {
          main.setAttribute('tabindex', '-1');
          main.focus();
        }
      }}
    >
      Skip to main content
    </a>
  );
}
