'use client';
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";
import { doSignOut } from "@/firebase/firebaseAuth";
import { User, ChevronDown, LogOut, PlusCircle, LayoutDashboard } from "lucide-react";
import Link from "next/link";

export default function Header(){
  const router = useRouter();
  const { userLoggedIn, currentUser } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await doSignOut();
    router.replace("/login");
  };

  return (
    <nav className="flex justify-between items-center w-full px-6 py-3 z-20 fixed top-0 left-0 shadow-md bg-white/90 backdrop-blur-md">
      <div
        onClick={() => router.push("/")}
        className="text-gray-800 text-xl font-bold tracking-wide cursor-pointer"
      >
        Resume Ranker
      </div>

      <div className="flex gap-4 items-center">
        {userLoggedIn ? (
          <div className="relative" ref={dropdownRef}>
            {/* Profile round button */}
            <button
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-yellow-500 text-white font-semibold hover:bg-yellow-600 transition"
            >
              {currentUser?.email?.[0]?.toUpperCase() || <User size={18} />}
            </button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fadeIn">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm text-gray-500">Signed in as</p>
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {currentUser?.email}
                  </p>
                </div>
                <div className="flex flex-col text-gray-700">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <LayoutDashboard size={16} />
                    Dashboard
                  </Link>
                  <Link
                    href="/"
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 transition"
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <PlusCircle size={16} />
                    New Job
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-red-600 transition"
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="border-2 border-blue-600 text-blue-700 px-4 py-1.5 rounded-full font-semibold hover:bg-blue-50 transition"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="border-2 border-green-600 text-green-700 px-4 py-1.5 rounded-full font-semibold hover:bg-green-50 transition"
            >
              Register
            </Link>
          </>
        )}
      </div>

      {/* Animation */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.15s ease-in-out forwards;
        }
      `}</style>
    </nav>
  );
}