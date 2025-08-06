"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doSignInWithEmailAndPassword } from "@/firebase/firebaseAuth";
import { useAuth } from "@/context/authContext";


export default function page(){
  const { userLoggedIn } = useAuth();
  const route = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");


  useEffect(() => {
    if (userLoggedIn) {
      route.replace("/"); // replace to prevent back button going to login
    }
  }, [userLoggedIn, route]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isSigningIn) {
      setIsSigningIn(true);
      setErrorMessage(""); // Clear previous errors
      try {
        await doSignInWithEmailAndPassword(email, password);
      } catch (error) {
        // Firebase provides error codes
        if (error.code === "auth/internal-error" || error.code === "auth/network-request-failed") {
          setErrorMessage("Server error. Please try again later.");
        } else {
          setErrorMessage("Invalid credentials. Please check your email and password.");
        }
        setIsSigningIn(false); // Re-enable button
      }
    }
  };

  return (
    <div>
      <main className="w-full h-screen flex self-center place-content-center place-items-center">
        <div className="w-96 text-gray-600 bg-white space-y-5 p-4 shadow-xl border rounded-xl">
          <div className="text-center">
            <div className="mt-2">
              <h3 className="text-gray-800 text-xl font-semibold sm:text-2xl">
                Welcome Back
              </h3>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="text-sm text-gray-600 font-bold">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg transition duration-300"
              />
            </div>

            <div>
              <label className="text-sm text-gray-600 font-bold">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                className="w-full mt-2 px-3 py-2 text-gray-500 bg-transparent outline-none border focus:border-indigo-600 shadow-sm rounded-lg transition duration-300"
              />
            </div>

            {errorMessage && (
              <span className="text-red-600 font-bold">{errorMessage}</span>
            )}

            <button
              type="submit"
              disabled={isSigningIn}
              className={`w-full px-4 py-2 text-white cursor-pointer font-medium rounded-lg ${
                isSigningIn
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-xl transition duration-300"
              }`}
            >
              {isSigningIn ? "Signing In..." : "Sign In"}
            </button>
          </form>
          <p className="text-center text-sm">
            Don't have an account?{" "}
            <Link href='/signup' className="hover:underline font-bold cursor-pointer">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
};

