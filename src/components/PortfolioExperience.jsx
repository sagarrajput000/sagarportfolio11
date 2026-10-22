"use client";

import { useEffect, useRef, useState } from "react";
import { portfolioData } from "../data/portfolioData.js";
import { createPortfolioScene } from "../main.js";

const panelTitles = {
  work: "A few things I've made.",
  experience: "What I'm learning now.",
  about: portfolioData.about.title,
  contact: "My inbox is open.",
  music: "A little listening corner.",
  terminal: "The portfolio console.",
};

export default function PortfolioExperience() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const formRef = useRef(null);
  const previousPanelRef = useRef(null);
  const [activePanel, setActivePanel] = useState(null);
  const [status, setStatus] = useState("Welcome to Sagar's 3D portfolio.");
  const [contactValues, setContactValues] = useState({
    name: "",
    email: "",
    message: "",
  });

  useEffect(() => {
    const scene = createPortfolioScene(canvasRef.current, {
      onPanelChange: setActivePanel,
      onStatusChange: setStatus,
      onContactFieldFocus: (field) => {
        document.getElementById(`contact-${field}`)?.focus();
      },
      onContactSubmit: () => formRef.current?.requestSubmit(),
      contactValues,
    });
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setPanel(activePanel);
    if (activePanel) {
      document.getElementById("portfolio-close")?.focus();
    } else if (previousPanelRef.current) {
      canvasRef.current?.focus();
    }
    previousPanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    sceneRef.current?.setContactValues(contactValues);
  }, [contactValues]);

  function handleContactSubmit(event) {
    event.preventDefault();
    const { name, email, message } = contactValues;
    const subject = encodeURIComponent(`Portfolio message from ${name}`);
    const body = encodeURIComponent(`${message}\n\nFrom: ${name} (${email})`);
    setStatus("Opening your email app to send the message.");
    window.location.href = `mailto:${portfolioData.contact.email}?subject=${subject}&body=${body}`;
  }

  const updateContact = (event) => {
    setContactValues((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  return (
    <main className="portfolio isolate h-full min-h-[500px] w-full" aria-label={`${portfolioData.name} interactive 3D portfolio`}>
      <canvas
        ref={canvasRef}
        className="portfolio-canvas absolute inset-0 block h-full w-full cursor-grab touch-none"
        tabIndex={0}
        aria-label="Interactive 3D bedroom portfolio. Drag to look around and select objects or section controls to explore."
      >
        A 3D bedroom studio containing Sagar&apos;s portfolio. Use the portfolio controls to navigate without WebGL.
      </canvas>

      <nav className="visually-hidden" aria-label="Portfolio sections">
        <button type="button" onClick={() => setActivePanel("work")}>Projects</button>
        <button type="button" onClick={() => setActivePanel("experience")}>Experience</button>
        <button type="button" onClick={() => setActivePanel("about")}>About</button>
        <button type="button" onClick={() => setActivePanel("contact")}>Contact</button>
        <button type="button" onClick={() => setActivePanel("music")}>Listening corner</button>
        <button type="button" onClick={() => setActivePanel("terminal")}>Open portfolio terminal</button>
        {activePanel && (
          <button id="portfolio-close" type="button" onClick={() => setActivePanel(null)}>
            Close current panel
          </button>
        )}
        <button type="button" onClick={() => sceneRef.current?.resetView()}>Reset room view</button>
        <button type="button" onClick={() => sceneRef.current?.toggleAmbientSound()}>
          Toggle optional ambient sound
        </button>
      </nav>

      <section
        className="visually-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        aria-hidden={!activePanel}
      >
        <h1 id="panel-title">{activePanel ? panelTitles[activePanel] : ""}</h1>
        {activePanel === "work" && (
          <ul>
            {portfolioData.projects.map((project) => (
              <li key={project.title}>
                <a href={project.url} target="_blank" rel="noreferrer">
                  {project.title}: {project.description.join(" ")}
                </a>
              </li>
            ))}
          </ul>
        )}
        {activePanel === "experience" && (
          <ul>
            {portfolioData.experience.map((item) => (
              <li key={item.title}>{item.title}: {item.description}</li>
            ))}
          </ul>
        )}
        {activePanel === "about" && (
          <>
            {portfolioData.about.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <p>Interests: {portfolioData.about.interests.join(", ")}.</p>
          </>
        )}
        {activePanel === "contact" && (
          <p>Contact {portfolioData.name} at {portfolioData.contact.email} using the form.</p>
        )}
        {activePanel === "music" && (
          <p>{portfolioData.music.description}</p>
        )}
        {activePanel === "terminal" && (
          <p>Interactive portfolio terminal. Type-free commands summarize Sagar&apos;s profile and projects.</p>
        )}
      </section>

      <form className="visually-hidden" ref={formRef} onSubmit={handleContactSubmit}>
        <label htmlFor="contact-name">Your name</label>
        <input
          id="contact-name"
          name="name"
          autoComplete="name"
          required
          value={contactValues.name}
          onChange={updateContact}
        />
        <label htmlFor="contact-email">Your email</label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={contactValues.email}
          onChange={updateContact}
        />
        <label htmlFor="contact-message">Your message</label>
        <textarea
          id="contact-message"
          name="message"
          required
          value={contactValues.message}
          onChange={updateContact}
        />
        <button type="submit">Send email</button>
      </form>

      <p className="visually-hidden" aria-live="polite">{status}</p>
    </main>
  );
}
