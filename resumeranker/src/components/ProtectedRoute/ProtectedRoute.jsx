'use client';
import { useAuth } from "@/context/authContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Loader from "../Loader/page";

export default function ProtectedRoute({ children }) {
  const { userLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !userLoggedIn) {
      router.push("/login"); // redirect to login if not authenticated
    }
  }, [userLoggedIn, loading, router]);

  if (loading || !userLoggedIn) {
    return <Loader/>; // or show a loader if you want
  }

  return children;
}
