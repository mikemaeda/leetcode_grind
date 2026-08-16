import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupMembers } from "@/db/schema";
import { currentAdmin } from "@/lib/admin";
import { LEETCODE_GROUP_ID } from "@/lib/domain/leetcode-group";
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}) { const admin=await currentAdmin(); if(!admin)return Response.json({error:"Forbidden"},{status:403}); const {id}=await params; if(id===admin.id)return Response.json({error:"You cannot remove yourself."},{status:400}); await getDb().update(groupMembers).set({leftAt:new Date().toISOString()}).where(and(eq(groupMembers.groupId,LEETCODE_GROUP_ID),eq(groupMembers.userId,id))); return Response.json({ok:true}); }
