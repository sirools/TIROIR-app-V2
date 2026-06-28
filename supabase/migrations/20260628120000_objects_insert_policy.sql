CREATE POLICY "objects: insert own"
  ON public.objects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "objects: update own"
  ON public.objects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "objects: delete own"
  ON public.objects FOR DELETE
  USING (auth.uid() = user_id);
