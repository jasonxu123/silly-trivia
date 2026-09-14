"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export default function Test() {
  const [time, setTime] = useState<string>();

  useEffect(() => {
    apiClient.getTime().then((res) => {
      if (res.status === 200) {
        setTime(`${res.body.iso} (${res.body.timeZone})`);
      }
    });
  }, []);

  return <div className="text-lg text-green-800">
    It works! Server time: {time ?? "loading..."}
  </div>
}
