"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/firebaseConfig";
import Link from "next/link";

export default function page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Basic validations
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (!validateEmail(email)) {
      setError("Invalid email format.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isRegistering) {
      setIsRegistering(true);
      // Firebase registration
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const firebaseUser = userCredential.user;

        // Send user data to backend
        const res = await fetch("http://localhost:8080/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          }),
        });

        if (res.ok) {
          setSuccess("Registered successfully!");
        } else {
          const data = await res.json();
          setError(data.error || "Failed to save user to database.");
        }
      } catch (err) {
        setError(err.message.replace("Firebase:", "").trim());
      }
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 md:p-20">
      <section className="flex flex-col md:flex-row w-full max-w-4xl rounded-2xl overflow-hidden">
        {/* Signup Form */}
        <div className="w-full md:w-1/2 p-6 sm:p-10 bg-white">
          <div className="space-y-4 md:space-y-6">
            <h1 className="text-xl font-bold text-gray-900 md:text-2xl">
              Create an account
            </h1>
            <form onSubmit={handleRegister} className="space-y-4 md:space-y-6">
              <div>
                <label className="text-sm text-gray-600 font-bold">Email</label>
                <input
                  disabled={isRegistering}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:indigo-600 shadow-sm rounded-lg transition duration-300"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 font-bold">
                  Password
                </label>
                <input
                  disabled={isRegistering}
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                  className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg transition duration-300"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 font-bold">
                  Confirm Password
                </label>
                <input
                  disabled={isRegistering}
                  type="password"
                  autoComplete="off"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                  }}
                  className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg transition duration-300"
                />
              </div>

              {error && <span className="text-red-600 font-bold">{error}</span>}
              {success && (
                <span className="text-green-600 font-bold">{success}</span>
              )}

              <button
                type="submit"
                className={`w-full px-4 py-2 text-white cursor-pointer font-medium rounded-lg ${
                  isRegistering
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl transition duration-300"
                }`}
              >
                {isRegistering ? "Signing Up..." : "Sign Up"}
              </button>
              <div className="text-sm text-center">
                Already have an account? {"   "}
                <Link
                  href="/login"
                  className="text-blue-700 font-medium hover:underline"
                >
                  Login
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Gradient background – hidden on small screens */}
        <div className="hidden md:flex w-1/2 bg-gradient-to-b from-[#ffed29] to-[#e856d5] p-12 items-center justify-center">
          <div className="text-3xl leading-11 font-bold text-gray-700">
            "Let AI screen and refine your resume — customized for any job you
            apply for."
          </div>
        </div>
      </section>
    </div>
  );
}
