'use client';
import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/authContext";
import { doSignOut } from "@/firebase/firebaseAuth";
import Link from "next/link";

export default function Header(){
  const route = useRouter();
  const { userLoggedIn } = useAuth();

  return (
    <nav className="flex justify-between items-center w-full px-6 py-3 z-20 fixed top-0 left-0 shadow-md bg-white/90 backdrop-blur-md">
      <div className="text-gray-600 text-xl font-bold tracking-wide">Resume Ranker</div>

      <div className="flex gap-4 items-center">
        {userLoggedIn ? (
          <button
            onClick={() =>
              doSignOut().then(() => {
               route.replace('/login')
              })
            }
            className="cursor-pointer bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-md font-bold font-semibold transition"
          >
            Logout
          </button>
        ) : (
          <>
            <Link
              href='/login'
              className="bg-white w-25 text-center border-2 border-blue-600 text-blue-700 hover:underline px-4 py-1.5 rounded-full text-md font-semibold transition"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="bg-white border-2 border-green-600 text-green-700 hover:underline px-4 py-1.5 rounded-full text-md font-semibold transition"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};



